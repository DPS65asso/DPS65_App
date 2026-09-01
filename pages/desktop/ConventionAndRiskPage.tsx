
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { 
    FileSpreadsheet, FileText, Download, CheckCircle2, Shield, Calendar, 
    Clock, MapPin, Users, Building, Phone, Mail, Upload, Sparkles, 
    ArrowRight, Info, AlertTriangle, RefreshCw, Layers, Check, FileCheck,
    HelpCircle, Monitor, Save, PenTool
} from 'lucide-react';
import { Button } from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { eventService } from '../../services/features/eventService';
import { generateUUID, getLocalDateString } from '../../utils/security';
import { 
    RiskGridData, 
    computeRiskGrid, 
    generateRiskGridPdf 
} from '../../services/riskGridService';
import { 
    ConventionFormData, 
    populateWordDocument, 
    inspectWordTags 
} from '../../services/wordConventionService';
import { generateOfficialConventionPdf } from '../../services/conventionPdfService';
import { AssociationBrandingManager } from '../../components/AssociationBrandingManager';
import { useNavigate } from 'react-router-dom';

const WORD_TEMPLATE_STORAGE_KEY = 'dps65_custom_word_template_base64';
const WORD_TEMPLATE_NAME_KEY = 'dps65_custom_word_template_name';

export const ConventionAndRiskPage: React.FC = () => {
    const { isAdmin, user } = useAuth();
    const navigate = useNavigate();
    
    // Tab
    const [activeTab, setActiveTab] = useState<'risk_grid' | 'convention' | 'word_template' | 'branding'>('risk_grid');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Template Word personnalisé
    const [customWordTemplate, setCustomWordTemplate] = useState<{ name: string; buffer: ArrayBuffer } | null>(null);
    const [templateTags, setTemplateTags] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // État Formulaire Grille des Risques & Convention
    const [formData, setFormData] = useState<RiskGridData & ConventionFormData>({
        // Événement
        eventName: '',
        eventDate: getLocalDateString(),
        eventTimeStart: '08:00',
        eventTimeEnd: '18:00',
        eventLocation: '',
        activityType: 'Compétition sportive / Trail',

        // Organisateur
        organizerName: '',
        organizerContact: '',
        organizerPhone: '',
        organizerEmail: '',
        nomOrganisateur: '',
        nomSociete: '',
        representantOrganisateur: '',
        nomResponsable: '',
        qualiteRepresentant: 'Président / Directeur de course',
        adresseOrganisateur: '65000 Tarbes',
        telephoneOrganisateur: '',
        emailOrganisateur: '',
        mailOrganisateur: '',

        // Facteurs RNMSC
        publicCount: 500,
        participantsCount: 200,
        e1Value: 0.35, // Dynamique / Sportif
        e1Label: 'Public debout : spectacle, fête foraine, événement sportif avec séparation du public et des sportifs...',
        e2Value: 0.30, // Plein air < 2ha ou parcours balisé
        e2Label: 'Structures non permanentes, espaces naturels < 2ha, brancardage > 150m, pente > 100m',
        tValue: 0.25, // < 10 min
        tLabel: 'Délai secours publics : < 10 minutes',
        specificRisks: ['Relief montagneux / Dénivelé', 'Météo variable', 'Effort cardio-vasculaire intense'],
        notes: '',

        // Calculs
        indiceI: 0,
        dispositifType: 'DPS-PE',
        recommendedSecouristes: 4,
        recommendedPse2: 2,
        recommendedPse1: 2,
        recommendedChefPoste: 1,
        recommendedChefSection: 0,
        recommendedVpsp: 1,

        // Moyens modulables avec toggles & quantités
        hasChefPoste: true,
        nbChefsPoste: 1,
        hasVpsp: true,
        nbVpsp: 1,
        hasVehiculePersonnel: true,
        nbVehiculePersonnel: 1,

        // Convention compléments
        nomEvenement: '',
        dateEvenement: getLocalDateString(),
        lieuEvenement: '',
        typeEvenement: 'Sportif',
        horairesDebut: '08:00',
        horairesFin: '18:00',
        horairesMiseEnPlace: '07:30',
        effectifPublic: 500,
        effectifParticipants: 200,
        dispositifEngage: 'DPS-PE',
        typeDispositif: 'DPS-PE',
        nbSecouristes: 4,
        nbPse2: 2,
        nbPse1: 2,
        coutPrestation: '450',
        repasPrisEnCharge: true,
        hebergementPrisEnCharge: false,
        localMiseADisposition: 'Tente de secours ou salle polyvalente',
        dateConvention: getLocalDateString(),
        lieuSignature: 'Tarbes',
        representantDps: 'Responsable Opérationnel DPS65',
        qualiteDps: 'Responsable des Dispositifs',
        telephoneDps: '06 00 00 00 00',
        emailDps: 'dps65.asso@gmail.com'
    });

    // Chargement du template Word sauvegardé dans IndexedDB / LocalStorage
    useEffect(() => {
        const savedBase64 = localStorage.getItem(WORD_TEMPLATE_STORAGE_KEY);
        const savedName = localStorage.getItem(WORD_TEMPLATE_NAME_KEY);
        if (savedBase64 && savedName) {
            try {
                const binary = atob(savedBase64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }
                const buffer = bytes.buffer;
                setCustomWordTemplate({ name: savedName, buffer });
                const tags = inspectWordTags(buffer);
                setTemplateTags(tags);
            } catch (e) {
                console.error("Erreur de décodage du template Word stocké", e);
            }
        }
    }, []);

    // Recalcul automatique du dimensionnement quand les facteurs changent
    useEffect(() => {
        const computed = computeRiskGrid({
            publicCount: formData.publicCount,
            participantsCount: formData.participantsCount,
            e1Value: formData.e1Value,
            e2Value: formData.e2Value,
            tValue: formData.tValue
        });

        setFormData(prev => ({
            ...prev,
            indiceI: computed.indiceI,
            dispositifType: computed.dispositifType,
            recommendedSecouristes: computed.recommendedSecouristes,
            recommendedPse2: computed.recommendedPse2,
            recommendedPse1: computed.recommendedPse1,
            recommendedChefPoste: computed.recommendedChefPoste,
            recommendedChefSection: computed.recommendedChefSection,
            recommendedVpsp: computed.recommendedVpsp,
            // Synchro convention & moyens
            dispositifEngage: computed.dispositifType,
            typeDispositif: computed.dispositifType,
            nbSecouristes: computed.recommendedSecouristes,
            nbPse2: computed.recommendedPse2,
            nbPse1: computed.recommendedPse1,
            nbChefsPoste: prev.hasChefPoste ? Math.max(1, computed.recommendedChefPoste) : 0,
            nbVpsp: prev.hasVpsp ? Math.max(1, computed.recommendedVpsp) : 0,
        }));
    }, [
        formData.publicCount, 
        formData.participantsCount, 
        formData.e1Value, 
        formData.e2Value, 
        formData.tValue
    ]);

    // Synchronisation mutuelle des champs clés
    const handleFieldChange = (field: string, value: any) => {
        setFormData(prev => {
            const next = { ...prev, [field]: value };
            
            // Synchro bidirectionnelle des champs partagés
            if (field === 'eventName' || field === 'nomEvenement') {
                next.nomEvenement = value;
                next.eventName = value;
            }
            
            if (field === 'eventDate' || field === 'dateEvenement') {
                next.dateEvenement = value;
                next.eventDate = value;
            }

            if (field === 'eventLocation' || field === 'lieuEvenement') {
                next.lieuEvenement = value;
                next.eventLocation = value;
            }

            if (field === 'organizerName' || field === 'nomOrganisateur' || field === 'nomSociete') {
                next.nomOrganisateur = value;
                next.organizerName = value;
                next.nomSociete = value;
            }

            if (field === 'organizerContact' || field === 'representantOrganisateur' || field === 'nomResponsable') {
                next.representantOrganisateur = value;
                next.organizerContact = value;
                next.nomResponsable = value;
            }

            if (field === 'organizerPhone' || field === 'telephoneOrganisateur') {
                next.telephoneOrganisateur = value;
                next.organizerPhone = value;
            }

            if (field === 'organizerEmail' || field === 'emailOrganisateur' || field === 'mailOrganisateur') {
                next.emailOrganisateur = value;
                next.organizerEmail = value;
                next.mailOrganisateur = value;
            }

            if (field === 'dispositifType' || field === 'dispositifEngage' || field === 'typeDispositif') {
                next.dispositifType = value;
                next.dispositifEngage = value;
                next.typeDispositif = value;
            }

            if (field === 'eventTimeStart') next.horairesDebut = value;
            if (field === 'eventTimeEnd') next.horairesFin = value;
            if (field === 'publicCount') next.effectifPublic = value;
            if (field === 'participantsCount') next.effectifParticipants = value;

            return next;
        });
    };

    // Gestion du téléversement du fichier Word modèle (.docx)
    const handleWordUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.docx')) {
            alert("Veuillez sélectionner un fichier Word au format .docx");
            return;
        }

        try {
            const buffer = await file.arrayBuffer();
            
            // Convertir en base64 pour persistance
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            localStorage.setItem(WORD_TEMPLATE_STORAGE_KEY, base64);
            localStorage.setItem(WORD_TEMPLATE_NAME_KEY, file.name);

            setCustomWordTemplate({ name: file.name, buffer });
            const tags = inspectWordTags(buffer);
            setTemplateTags(tags);

            setSuccessMessage(`Modèle Word "${file.name}" enregistré avec succès ! ${tags.length} variables détectées.`);
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            alert(`Erreur de lecture du fichier Word : ${err.message}`);
        }
    };

    // Export PDF de la Grille d'Évaluation des Risques
    const handleExportRiskPdf = async () => {
        try {
            await generateRiskGridPdf(formData);
        } catch (e: any) {
            alert(`Erreur lors de la génération du PDF : ${e.message}`);
        }
    };

    // Export Convention (Word ou PDF)
    const handleExportConventionWord = async () => {
        if (!customWordTemplate) {
            // Pas de modèle Word fourni, on propose l'export PDF direct ou alerte
            if (confirm("Aucun modèle Word .docx personnalisé n'est encore chargé. Souhaitez-vous générer la convention officielle en format PDF ?")) {
                await generateOfficialConventionPdf(formData);
            }
            return;
        }

        try {
            const blob = await populateWordDocument(customWordTemplate.buffer, formData);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Convention_DPS65_${formData.nomEvenement || 'Evenement'}_${formData.dateEvenement}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            alert(`Erreur de génération Word : ${e.message}`);
        }
    };

    const handleExportConventionPdf = async () => {
        try {
            await generateOfficialConventionPdf(formData);
        } catch (e: any) {
            alert(`Erreur lors de la génération du PDF de convention : ${e.message}`);
        }
    };

    // Action Clé : Valider et Créer Automatiquement l'Événement + Mission Planning
    const handleCreateEventAndMission = async () => {
        if (!formData.eventName.trim()) {
            alert("Veuillez renseigner au minimum le nom de l'événement.");
            return;
        }

        setIsSubmitting(true);
        try {
            const eventId = generateUUID();
            const missionId = generateUUID();

            // 1. Création de l'Événement (table events)
            await eventService.saveEvent({
                id: eventId,
                name: formData.eventName.trim(),
                date: formData.eventDate,
                location: formData.eventLocation || 'Hautes-Pyrénées (65)',
                createdAt: Date.now(),
                resourceConfig: {
                    totalStretchers: formData.recommendedVpsp || 1,
                    totalChairs: 2
                },
                supervisorName: formData.representantDps || 'Responsable DPS65',
                supervisorPhone: formData.telephoneDps || ''
            });

            // 2. Création de la Mission Planning (table missions)
            await eventService.saveMission({
                id: missionId,
                title: formData.eventName.trim(),
                date: formData.eventDate,
                timeStart: formData.eventTimeStart || '08:00',
                timeEnd: formData.eventTimeEnd || '18:00',
                location: formData.eventLocation || 'Hautes-Pyrénées (65)',
                type: 'DPS',
                requiredPse1: formData.recommendedPse1 || 2,
                requiredPse2: formData.recommendedPse2 || 2,
                requiredIde: 0,
                requiredMed: 0,
                registeredUserIds: user ? [user.id] : []
            });

            setSuccessMessage(`✅ Événement et Mission créés avec succès dans l'application !`);
            
            setTimeout(() => {
                navigate('/events');
            }, 1200);

        } catch (e: any) {
            console.error("Erreur création automatique :", e);
            alert(`Erreur lors de la création : ${e.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Layout title="Conventions & Grille des Risques (Bureau)">
            <div className="max-w-6xl mx-auto space-y-6 pb-20">
                
                {/* En-tête desktop */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-2xl">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-blue-400 bg-blue-950/60 px-3 py-1 rounded-full border border-blue-800/60 w-fit">
                            <Monitor className="w-4 h-4 text-blue-400" /> Module Administratif & Réglementaire (Mode Bureau)
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                            Convention Organisateur & Grille des Risques
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                            Renseignez les données organisateur une seule fois : calcul automatique du dimensionnement réglementaire (RNMSC), génération de la convention pré-remplie (Word / PDF) et injection instantanée dans la liste des Événements et le Planning des Secouristes.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <Button 
                            variant="primary" 
                            size="lg"
                            icon={<CheckCircle2 className="w-5 h-5 text-emerald-300" />}
                            onClick={handleCreateEventAndMission}
                            disabled={isSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/30 text-white font-black w-full md:w-auto"
                        >
                            {isSubmitting ? 'Création en cours...' : 'Créer Événement + Planning'}
                        </Button>
                    </div>
                </div>

                {/* Message de succès */}
                {successMessage && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-2xl flex items-center gap-3 animate-fadeIn">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                        <span className="font-bold text-sm">{successMessage}</span>
                    </div>
                )}

                {/* Onglets de navigation */}
                <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('risk_grid')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            activeTab === 'risk_grid'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>1. Grille d'Évaluation des Risques (RNMSC)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('convention')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            activeTab === 'convention'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>2. Convention Organisateur</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('word_template')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            activeTab === 'word_template'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                    >
                        <Upload className="w-4 h-4" />
                        <span>3. Modèle Word Personnalisé (.docx)</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('branding')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                            activeTab === 'branding'
                                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                    >
                        <PenTool className="w-4 h-4" />
                        <span>4. Signature & Logo Asso</span>
                    </button>
                </div>

                {/* VUE 1 : GRILLE D'ÉVALUATION DES RISQUES */}
                {activeTab === 'risk_grid' && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* Colonne de Saisie des Paramètres (8/12) */}
                        <div className="lg:col-span-8 space-y-6">
                            
                            {/* Renseignements Manifestation */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                                <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                    <Building className="w-4 h-4 text-blue-500" /> Informations Manifestation & Organisateur
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nom de l'Événement *</label>
                                        <input 
                                            type="text"
                                            value={formData.eventName}
                                            onChange={(e) => handleFieldChange('eventName', e.target.value)}
                                            placeholder="Ex: Trail du Pic du Midi"
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lieu / Commune *</label>
                                        <input 
                                            type="text"
                                            value={formData.eventLocation}
                                            onChange={(e) => handleFieldChange('eventLocation', e.target.value)}
                                            placeholder="Ex: Cauterets / Saint-Lary"
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date du Dispositif</label>
                                        <input 
                                            type="date"
                                            value={formData.eventDate}
                                            onChange={(e) => handleFieldChange('eventDate', e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Début</label>
                                            <input 
                                                type="time"
                                                value={formData.eventTimeStart}
                                                onChange={(e) => handleFieldChange('eventTimeStart', e.target.value)}
                                                className="w-full px-2 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fin</label>
                                            <input 
                                                type="time"
                                                value={formData.eventTimeEnd}
                                                onChange={(e) => handleFieldChange('eventTimeEnd', e.target.value)}
                                                className="w-full px-2 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nom Structure Organisatrice</label>
                                        <input 
                                            type="text"
                                            value={formData.organizerName}
                                            onChange={(e) => handleFieldChange('organizerName', e.target.value)}
                                            placeholder="Ex: Club Athlétique Pyrénéen"
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Responsable / Contact Organisateur</label>
                                        <input 
                                            type="text"
                                            value={formData.organizerContact}
                                            onChange={(e) => handleFieldChange('organizerContact', e.target.value)}
                                            placeholder="Ex: Jean Dupont (06 12 34 56 78)"
                                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Paramètres de Calcul RNMSC */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                        <Shield className="w-4 h-4 text-rose-500" /> Facteurs Réglementaires du Risque (RNMSC)
                                    </h3>
                                    <span className="text-[11px] font-mono bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded-full font-bold">
                                        Formule I = P x (E1 + E2 + T)
                                    </span>
                                </div>

                                {/* 1. Effectif P */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Public / Spectateurs Simultanés (P1)
                                        </label>
                                        <input 
                                            type="number"
                                            min="0"
                                            value={formData.publicCount}
                                            onChange={(e) => handleFieldChange('publicCount', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Nombre maximum de spectateurs présents au même instant.</p>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Participants / Concurrents Actifs (P2)
                                        </label>
                                        <input 
                                            type="number"
                                            min="0"
                                            value={formData.participantsCount}
                                            onChange={(e) => handleFieldChange('participantsCount', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">Coureurs, athlètes, figurants, exposants.</p>
                                    </div>
                                </div>

                                {/* 2. Facteur E1 (Niveau de risque / Comportement du public) */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black uppercase text-slate-800 dark:text-white flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <AlertTriangle className="w-4 h-4 text-amber-500" /> E1 — Comportement du Public & Nature de l'Activité
                                        </span>
                                        <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-[11px] bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                            Coeff : {formData.e1Value.toFixed(2)}
                                        </span>
                                    </label>
                                    <select
                                        value={formData.e1Value}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            let lbl = "Public assis : spectacle, cérémonie, réunion, restauration, sport...";
                                            if (val === 0.30) lbl = "Public debout : cérémonie, réunion, restauration, foire, salon...";
                                            if (val === 0.35) lbl = "Public debout : spectacle, fête foraine, événement sportif avec séparation...";
                                            if (val === 0.40) lbl = "Public debout : spectacle dynamique, danse, féria, carnaval, sans protection...";
                                            handleFieldChange('e1Value', val);
                                            handleFieldChange('e1Label', lbl);
                                        }}
                                        className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                                    >
                                        <option value={0.25}>0.25 — Public assis : spectacle, cérémonie, réunion, restauration, sport...</option>
                                        <option value={0.30}>0.30 — Public debout : cérémonie, réunion, restauration, foire, salon...</option>
                                        <option value={0.35}>0.35 — Public debout : spectacle, fête foraine, événement sportif avec séparation...</option>
                                        <option value={0.40}>0.40 — Public debout : spectacle dynamique, danse, féria, carnaval, multi-jours...</option>
                                    </select>
                                </div>

                                {/* 3. Facteur E2 (Environnement et accessibilité du site) */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black uppercase text-slate-800 dark:text-white flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <MapPin className="w-4 h-4 text-emerald-500" /> E2 — Environnement & Accessibilité du Site
                                        </span>
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                            Coeff : {formData.e2Value.toFixed(2)}
                                        </span>
                                    </label>
                                    <select
                                        value={formData.e2Value}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            let lbl = "Structures permanentes (bâtiment, salle en dur), voies dégagées, accès aisé";
                                            if (val === 0.30) lbl = "Structures non permanentes (gradins, chapiteaux), espaces < 2ha, brancardage > 150m, pente > 100m";
                                            if (val === 0.35) lbl = "Espaces naturels < 5ha, brancardage > 300m, pente > 150m, accès difficiles";
                                            if (val === 0.40) lbl = "Espaces naturels > 5ha, brancardage > 600m, pente > 300m, progression difficile";
                                            handleFieldChange('e2Value', val);
                                            handleFieldChange('e2Label', lbl);
                                        }}
                                        className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                    >
                                        <option value={0.25}>0.25 — Structures permanentes en dur, voies dégagées, accès aisé</option>
                                        <option value={0.30}>0.30 — Structures non permanentes (chapiteaux, gradins), espaces &lt; 2ha, brancardage &gt; 150m</option>
                                        <option value={0.35}>0.35 — Espaces naturels &lt; 5ha, brancardage &gt; 300m, pentes &gt; 150m, accès difficile</option>
                                        <option value={0.40}>0.40 — Espaces naturels &gt; 5ha, brancardage &gt; 600m, relief escarpé, accès complexe</option>
                                    </select>
                                </div>

                                {/* 4. Facteur T (Délai d'intervention des secours publics) */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-black uppercase text-slate-800 dark:text-white flex items-center justify-between">
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-blue-500" /> T — Délai d'Intervention des Secours Publics (SDIS 65 / SAMU 65)
                                        </span>
                                        <span className="font-mono text-blue-600 dark:text-blue-400 font-bold text-[11px] bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                                            Coeff : {formData.tValue.toFixed(2)}
                                        </span>
                                    </label>
                                    <select
                                        value={formData.tValue}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            let lbl = "Délai secours publics : < 10 minutes";
                                            if (val === 0.30) lbl = "Délai secours publics : 10 à 20 minutes";
                                            if (val === 0.35) lbl = "Délai secours publics : 20 à 30 minutes";
                                            if (val === 0.40) lbl = "Délai secours publics : > 30 minutes";
                                            handleFieldChange('tValue', val);
                                            handleFieldChange('tLabel', lbl);
                                        }}
                                        className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    >
                                        <option value={0.25}>0.25 — Moins de 10 minutes (&lt; 10 min)</option>
                                        <option value={0.30}>0.30 — 10 à 20 minutes</option>
                                        <option value={0.35}>0.35 — 20 à 30 minutes</option>
                                        <option value={0.40}>0.40 — Plus de 30 minutes (&gt; 30 min)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Colonne de Résultat du Dimensionnement (4/12) */}
                        <div className="lg:col-span-4 space-y-6">
                            
                            {/* Card Résultat Calcul & Moyens modulables */}
                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border-2 border-rose-500 dark:border-rose-600 shadow-xl space-y-5">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <span className="text-[10px] font-black tracking-wider uppercase text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                                            Dimensionnement RNMSC
                                        </span>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                                            {formData.dispositifType}
                                        </h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Indice calculé : <strong className="text-slate-800 dark:text-white font-mono">{(formData.indiceI / 1000).toFixed(3)}</strong>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                            {formData.nbSecouristes}
                                        </span>
                                        <p className="text-[10px] uppercase font-bold text-slate-400">Secouristes</p>
                                    </div>
                                </div>

                                {/* Répartition Secouristes */}
                                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700/60 space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-600 dark:text-slate-300 font-medium">Intervenants Secouristes :</span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleFieldChange('nbSecouristes', Math.max(2, Number(formData.nbSecouristes) - 1))}
                                                className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-xs hover:bg-slate-100 text-slate-700 dark:text-slate-200"
                                            >
                                                -
                                            </button>
                                            <span className="w-8 text-center font-bold text-xs text-slate-900 dark:text-white">
                                                {formData.nbSecouristes}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleFieldChange('nbSecouristes', Number(formData.nbSecouristes) + 1)}
                                                className="w-6 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-xs hover:bg-slate-100 text-slate-700 dark:text-slate-200"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-700/50">
                                        <span>PSE2 (Chef équipe / Équipier) : <strong>{formData.recommendedPse2}</strong></span>
                                        <span>PSE1 (Secouriste) : <strong>{formData.recommendedPse1}</strong></span>
                                    </div>
                                </div>

                                {/* Toggles & Quantités Personnalisables (Véhicules et Chefs de poste) */}
                                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                                        Moyens & Encadrement modulables
                                    </h4>

                                    {/* 1. Chef de poste */}
                                    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                                        <div className="flex items-center gap-2.5">
                                            <input 
                                                type="checkbox"
                                                id="toggleChefPoste"
                                                checked={!!formData.hasChefPoste}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    handleFieldChange('hasChefPoste', checked);
                                                    handleFieldChange('nbChefsPoste', checked ? Math.max(1, Number(formData.nbChefsPoste || 1)) : 0);
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <label htmlFor="toggleChefPoste" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                                                Chef de Poste
                                            </label>
                                        </div>
                                        {formData.hasChefPoste && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleFieldChange('nbChefsPoste', Math.max(1, Number(formData.nbChefsPoste) - 1))}
                                                    className="w-5 h-5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10px] text-slate-700 dark:text-slate-200"
                                                >
                                                    -
                                                </button>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    value={formData.nbChefsPoste}
                                                    onChange={(e) => handleFieldChange('nbChefsPoste', Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-10 text-center text-xs font-bold py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleFieldChange('nbChefsPoste', Number(formData.nbChefsPoste) + 1)}
                                                    className="w-5 h-5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10px] text-slate-700 dark:text-slate-200"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Véhicule de Premier Secours (VPSP) */}
                                    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                                        <div className="flex items-center gap-2.5">
                                            <input 
                                                type="checkbox"
                                                id="toggleVpsp"
                                                checked={!!formData.hasVpsp}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    handleFieldChange('hasVpsp', checked);
                                                    handleFieldChange('nbVpsp', checked ? Math.max(1, Number(formData.nbVpsp || 1)) : 0);
                                                }}
                                                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500"
                                            />
                                            <label htmlFor="toggleVpsp" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                                                Véhicule Premiers Secours (VPSP)
                                            </label>
                                        </div>
                                        {formData.hasVpsp && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleFieldChange('nbVpsp', Math.max(1, Number(formData.nbVpsp) - 1))}
                                                    className="w-5 h-5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10px] text-slate-700 dark:text-slate-200"
                                                >
                                                    -
                                                </button>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    value={formData.nbVpsp}
                                                    onChange={(e) => handleFieldChange('nbVpsp', Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-10 text-center text-xs font-bold py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleFieldChange('nbVpsp', Number(formData.nbVpsp) + 1)}
                                                    className="w-5 h-5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10px] text-slate-700 dark:text-slate-200"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Véhicule Personnel / VL */}
                                    <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                                        <div className="flex items-center gap-2.5">
                                            <input 
                                                type="checkbox"
                                                id="toggleVehiculePersonnel"
                                                checked={!!formData.hasVehiculePersonnel}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    handleFieldChange('hasVehiculePersonnel', checked);
                                                    handleFieldChange('nbVehiculePersonnel', checked ? Math.max(1, Number(formData.nbVehiculePersonnel || 1)) : 0);
                                                }}
                                                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                            />
                                            <label htmlFor="toggleVehiculePersonnel" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                                                Véhicule Personnel (VL)
                                            </label>
                                        </div>
                                        {formData.hasVehiculePersonnel && (
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleFieldChange('nbVehiculePersonnel', Math.max(1, Number(formData.nbVehiculePersonnel) - 1))}
                                                    className="w-5 h-5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10px] text-slate-700 dark:text-slate-200"
                                                >
                                                    -
                                                </button>
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    value={formData.nbVehiculePersonnel}
                                                    onChange={(e) => handleFieldChange('nbVehiculePersonnel', Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-10 text-center text-xs font-bold py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleFieldChange('nbVehiculePersonnel', Number(formData.nbVehiculePersonnel) + 1)}
                                                    className="w-5 h-5 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold text-[10px] text-slate-700 dark:text-slate-200"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                                    <Button 
                                        variant="outline" 
                                        icon={<Download className="w-4 h-4 text-rose-500" />}
                                        onClick={handleExportRiskPdf}
                                        className="w-full justify-center font-bold"
                                    >
                                        Exporter Grille en PDF
                                    </Button>

                                    <Button 
                                        variant="primary"
                                        icon={<ArrowRight className="w-4 h-4" />}
                                        onClick={() => setActiveTab('convention')}
                                        className="w-full justify-center font-bold"
                                    >
                                        Passer à la Convention
                                    </Button>
                                </div>
                            </div>

                            {/* Mémo Réglementaire */}
                            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                                <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                    <Info className="w-4 h-4 text-blue-500" /> Rappel des Seuils RNMSC
                                </h4>
                                <ul className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                                    <li>• <strong>i ≤ 0.25</strong> : PAPS (2 secouristes)</li>
                                    <li>• <strong>0.25 &lt; i ≤ 1.125</strong> : DPS-PE (2 à 12 intervenants)</li>
                                    <li>• <strong>1.125 &lt; i ≤ 12</strong> : DPS-ME (13 à 36 intervenants)</li>
                                    <li>• <strong>i &gt; 12</strong> : DPS-GE (&gt; 36 intervenants)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* VUE 2 : CONVENTION ORGANISATEUR */}
                {activeTab === 'convention' && (
                    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div>
                                <h2 className="text-lg font-black text-slate-800 dark:text-white">
                                    Convention DPS avec l'Organisateur
                                </h2>
                                <p className="text-xs text-slate-400">
                                    Les données saisies dans la grille ont été automatiquement répercutées. Complétez les modalités financières et logistiques.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button 
                                    variant="outline"
                                    icon={<Download className="w-4 h-4 text-blue-600" />}
                                    onClick={handleExportConventionPdf}
                                    size="sm"
                                >
                                    Exporter en PDF
                                </Button>

                                <Button 
                                    variant="primary"
                                    icon={<Download className="w-4 h-4 text-white" />}
                                    onClick={handleExportConventionWord}
                                    size="sm"
                                    className="bg-blue-600 hover:bg-blue-500"
                                >
                                    {customWordTemplate ? 'Remplir mon Fichier Word (.docx)' : 'Générer Convention Word'}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Volet Organisateur & Événement */}
                            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <h3 className="text-xs font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider flex items-center justify-between">
                                    <span>Coordonnées & Événement</span>
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">Modèle Word</span>
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Nom de l'Événement <span className="text-slate-400 font-mono text-[10px]">{`{nom_evenement}`}</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={formData.nomEvenement}
                                            onChange={(e) => handleFieldChange('nomEvenement', e.target.value)}
                                            placeholder="Ex: Trail du Pic du Midi"
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Lieu de l'Événement <span className="text-slate-400 font-mono text-[10px]">{`{lieu_evenement}`}</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={formData.lieuEvenement}
                                            onChange={(e) => handleFieldChange('lieuEvenement', e.target.value)}
                                            placeholder="Ex: La Mongie / Bagnères"
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                        Nom de la Société / Organisateur <span className="text-slate-400 font-mono text-[10px]">{`{nom_societe}`}</span>
                                    </label>
                                    <input 
                                        type="text"
                                        value={formData.nomOrganisateur}
                                        onChange={(e) => handleFieldChange('nomOrganisateur', e.target.value)}
                                        placeholder="Ex: Club Athlétique Pyrénéen"
                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Nom du Responsable <span className="text-slate-400 font-mono text-[10px]">{`{nom_responsable}`}</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={formData.representantOrganisateur}
                                            onChange={(e) => handleFieldChange('representantOrganisateur', e.target.value)}
                                            placeholder="M. Jean DUPONT"
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Qualité / Titre</label>
                                        <input 
                                            type="text"
                                            value={formData.qualiteRepresentant}
                                            onChange={(e) => handleFieldChange('qualiteRepresentant', e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Mail Organisateur <span className="text-slate-400 font-mono text-[10px]">{`{mail_organisateur}`}</span>
                                        </label>
                                        <input 
                                            type="email"
                                            value={formData.emailOrganisateur}
                                            onChange={(e) => handleFieldChange('emailOrganisateur', e.target.value)}
                                            placeholder="contact@organisation.fr"
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Téléphone Organisateur</label>
                                        <input 
                                            type="text"
                                            value={formData.telephoneOrganisateur}
                                            onChange={(e) => handleFieldChange('telephoneOrganisateur', e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Adresse Siège Organisateur</label>
                                    <input 
                                        type="text"
                                        value={formData.adresseOrganisateur}
                                        onChange={(e) => handleFieldChange('adresseOrganisateur', e.target.value)}
                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Volet Dispositif & Modalités */}
                            <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                                <h3 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center justify-between">
                                    <span>Dispositif Engagé & Logistique</span>
                                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded font-mono">Moyens Inclus</span>
                                </h3>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Dispositif Engagé <span className="text-slate-400 font-mono text-[10px]">{`{dispositif_engage}`}</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={formData.dispositifEngage || formData.typeDispositif}
                                            onChange={(e) => handleFieldChange('dispositifEngage', e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-blue-600 dark:text-blue-400"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Intervenants Secouristes <span className="text-slate-400 font-mono text-[10px]">{`{nb_secouristes}`}</span>
                                        </label>
                                        <input 
                                            type="number"
                                            min="1"
                                            value={formData.nbSecouristes}
                                            onChange={(e) => handleFieldChange('nbSecouristes', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Véhicules VPSP <span className="text-slate-400 font-mono text-[10px]">{`{nb_vpsp}`}</span>
                                        </label>
                                        <input 
                                            type="number"
                                            min="0"
                                            value={formData.nbVpsp}
                                            onChange={(e) => handleFieldChange('nbVpsp', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Véhicules Personnels (VL) <span className="text-slate-400 font-mono text-[10px]">{`{nb_vehicule_personnel}`}</span>
                                        </label>
                                        <input 
                                            type="number"
                                            min="0"
                                            value={formData.nbVehiculePersonnel}
                                            onChange={(e) => handleFieldChange('nbVehiculePersonnel', parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Montant Prestation (€ TTC)</label>
                                        <input 
                                            type="number"
                                            value={formData.coutPrestation}
                                            onChange={(e) => handleFieldChange('coutPrestation', e.target.value)}
                                            placeholder="450"
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                                            Date Convention <span className="text-slate-400 font-mono text-[10px]">{`{date_convention}`}</span>
                                        </label>
                                        <input 
                                            type="date"
                                            value={formData.dateConvention}
                                            onChange={(e) => handleFieldChange('dateConvention', e.target.value)}
                                            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Local / Espace mis à disposition</label>
                                    <input 
                                        type="text"
                                        value={formData.localMiseADisposition}
                                        onChange={(e) => handleFieldChange('localMiseADisposition', e.target.value)}
                                        placeholder="Ex: Salle polyvalente, tente PC secours"
                                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <label className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={!!formData.repasPrisEnCharge}
                                            onChange={(e) => handleFieldChange('repasPrisEnCharge', e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Repas Secouristes</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                                        <input 
                                            type="checkbox"
                                            checked={!!formData.hebergementPrisEnCharge}
                                            onChange={(e) => handleFieldChange('hebergementPrisEnCharge', e.target.checked)}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Hébergement Fourni</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Barre d'action finale */}
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <Sparkles className="w-5 h-5 text-blue-600 shrink-0" />
                                <div className="text-xs">
                                    <p className="font-bold text-blue-900 dark:text-blue-200">Prêt à officialiser l'événement ?</p>
                                    <p className="text-blue-700 dark:text-blue-400">Le bouton ci-contre enregistre l'événement sur la plateforme et ouvre les inscriptions pour vos secouristes.</p>
                                </div>
                            </div>

                            <Button 
                                variant="primary"
                                icon={<CheckCircle2 className="w-5 h-5 text-emerald-300" />}
                                onClick={handleCreateEventAndMission}
                                disabled={isSubmitting}
                                className="bg-emerald-600 hover:bg-emerald-500 font-bold whitespace-nowrap shadow-lg shadow-emerald-600/20"
                            >
                                {isSubmitting ? 'Enregistrement...' : 'Valider & Créer Événement + Planning'}
                            </Button>
                        </div>
                    </div>
                )}

                {/* VUE 3 : GESTION DU MODÈLE WORD PERSONNALISÉ */}
                {activeTab === 'word_template' && (
                    <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                        <div className="max-w-3xl space-y-2">
                            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <FileText className="w-5 h-5 text-blue-500" /> Votre Convention Word (.docx) Pré-rédigée
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Déposez ici votre fichier Word habituel. L'application remplira automatiquement tous les tags entre accolades <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-xs">{`{nom_organisateur}`}</code>, <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-xs">{`{date_evenement}`}</code>, etc., sur l'ensemble des pages de votre document !
                            </p>
                        </div>

                        {/* Zone de Drop / Upload */}
                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-3xl p-8 text-center bg-slate-50 dark:bg-slate-900/40 space-y-4">
                            <input 
                                type="file" 
                                accept=".docx"
                                ref={fileInputRef}
                                onChange={handleWordUpload}
                                className="hidden" 
                            />

                            <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mx-auto">
                                <Upload className="w-8 h-8" />
                            </div>

                            <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-white">
                                    {customWordTemplate ? (
                                        <span className="text-emerald-600 dark:text-emerald-400">✅ Fichier actif : {customWordTemplate.name}</span>
                                    ) : (
                                        "Glissez-déposez votre modèle Word .docx ou cliquez pour sélectionner"
                                    )}
                                </p>
                                <p className="text-xs text-slate-400">Format Microsoft Word (.docx) supporté</p>
                            </div>

                            <Button 
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                icon={<Upload className="w-4 h-4" />}
                                className="mx-auto"
                            >
                                {customWordTemplate ? 'Remplacer le modèle Word' : 'Importer mon fichier Word'}
                            </Button>
                        </div>

                        {/* Variables reconnues dans votre modèle */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-emerald-500" /> Les 10 Balises Automatiques pour votre Modèle Word
                                </h3>
                                <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    Remplacement 100% Automatique
                                </span>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Placez simplement l'une de ces balises dans votre document Word (en majuscules, minuscules ou avec tirets). Le moteur effectue le remplacement sur l'intégralité du fichier :
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">1. Date de la convention</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">JJ/MM/AAAA</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{date_convention}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{dateConvention}`}, {`{date_contrat}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">2. Nom de l'événement</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Texte</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{nom_evenement}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{nomEvenement}`}, {`{event_name}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">3. Lieu de l'événement</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Commune / Site</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{lieu_evenement}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{lieuEvenement}`}, {`{lieu}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">4. Nom de la société</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Organisateur</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{nom_societe}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{nom_organisateur}`}, {`{societe}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">5. Nom du responsable</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Signataire</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{nom_responsable}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{representant_organisateur}`}, {`{responsable}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">6. Mail de l'organisateur</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Courriel</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{mail_organisateur}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{email_organisateur}`}, {`{email}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">7. Dispositif engagé</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Type DPS</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{dispositif_engage}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{type_dispositif}`}, {`{dispositif}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">8. Intervenants secouristes</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Nombre</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{nb_secouristes}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{nbSecouristes}`}, {`{secouristes}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">9. Véhicule personnel (VL)</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">Quantité</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{nb_vehicule_personnel}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{nbVehiculePersonnel}`}, {`{vehicule_personnel}`}</p>
                                </div>

                                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 dark:text-white">10. Véhicule Premier Secours</span>
                                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">VPSP</span>
                                    </div>
                                    <code className="font-mono text-blue-600 dark:text-blue-400 font-bold text-xs mt-1 block">{`{nb_vpsp}`}</code>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Alias : {`{nbVpsp}`}, {`{vpsp}`}, {`{nb_vehicules_premiers_secours}`}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VUE 4 : GESTION DE LA SIGNATURE & DU LOGO ASSEMBLE */}
                {activeTab === 'branding' && (
                    <AssociationBrandingManager />
                )}

            </div>
        </Layout>
    );
};
