import React, { useState, useEffect, useRef } from 'react';
import { 
    PenTool, 
    Upload, 
    Trash2, 
    Check, 
    RotateCcw, 
    Image as ImageIcon, 
    ShieldCheck, 
    FileText, 
    UserCheck,
    Download
} from 'lucide-react';
import { Button } from './Button';
import { 
    getStoredLogo, 
    setStoredLogo, 
    removeStoredLogo, 
    getStoredSignature, 
    setStoredSignature, 
    removeStoredSignature,
    getStoredSignatoryInfo,
    setStoredSignatoryInfo,
    isAutoSignEnabled,
    setAutoSignEnabled
} from '../services/pdfUtils';
import { generateRiskGridPdf, RiskGridData } from '../services/riskGridService';
import { getLocalDateString } from '../utils/security';

interface AssociationBrandingManagerProps {
    onAssetsUpdated?: () => void;
}

export const AssociationBrandingManager: React.FC<AssociationBrandingManagerProps> = ({ onAssetsUpdated }) => {
    // État du Logo
    const [logoBase64, setLogoBase64] = useState<string | null>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // État de la Signature
    const [signatureBase64, setSignatureBase64] = useState<string | null>(null);
    const [signatureMode, setSignatureMode] = useState<'draw' | 'upload'>('draw');
    const signatureInputRef = useRef<HTMLInputElement>(null);

    // État du Signataire
    const [signatoryName, setSignatoryName] = useState<string>('Responsable Opérationnel DPS65');
    const [signatoryTitle, setSignatoryTitle] = useState<string>('Chef de Dispositif / Évaluateur');
    const [autoSign, setAutoSign] = useState<boolean>(true);

    // Canvas de dessin
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [penColor, setPenColor] = useState<string>('#1E3A8A'); // Bleu marine par défaut
    const [penSize, setPenSize] = useState<number>(2.5);

    // Message d'information
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Initialisation depuis le stockage local
    useEffect(() => {
        const storedLogo = getStoredLogo();
        if (storedLogo) setLogoBase64(storedLogo);

        const storedSig = getStoredSignature();
        if (storedSig) setSignatureBase64(storedSig);

        const storedSignatory = getStoredSignatoryInfo();
        setSignatoryName(storedSignatory.name);
        setSignatoryTitle(storedSignatory.title);

        setAutoSign(isAutoSignEnabled());
    }, []);

    const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
        setFeedbackMessage({ text, type });
        setTimeout(() => setFeedbackMessage(null), 4000);
    };

    // --- LOGO MANAGEMENT ---
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showFeedback('Veuillez sélectionner un fichier image valide (PNG, JPG, SVG)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
                setStoredLogo(base64);
                setLogoBase64(base64);
                showFeedback('Logo de l\'association mis à jour avec succès !');
                if (onAssetsUpdated) onAssetsUpdated();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleResetLogo = () => {
        removeStoredLogo();
        setLogoBase64(null);
        showFeedback('Logo réinitialisé au logo DPS65 par défaut.');
        if (onAssetsUpdated) onAssetsUpdated();
    };

    // --- SIGNATURE CANVAS MANAGEMENT ---
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const saveDrawnSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Vérifier si le canvas n'est pas vide
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const isBlank = !imgData.data.some(channel => channel !== 0);

        if (isBlank) {
            showFeedback('Veuillez dessiner votre signature avant de sauvegarder.', 'error');
            return;
        }

        const dataUrl = canvas.toDataURL('image/png');
        setStoredSignature(dataUrl);
        setSignatureBase64(dataUrl);
        showFeedback('Signature enregistrée avec succès !');
        if (onAssetsUpdated) onAssetsUpdated();
    };

    // --- SIGNATURE UPLOAD MANAGEMENT ---
    const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showFeedback('Veuillez sélectionner un fichier image valide (PNG avec fond transparent recommandé)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
                setStoredSignature(base64);
                setSignatureBase64(base64);
                showFeedback('Signature / Cachet importé avec succès !');
                if (onAssetsUpdated) onAssetsUpdated();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDeleteSignature = () => {
        removeStoredSignature();
        setSignatureBase64(null);
        clearCanvas();
        showFeedback('Signature supprimée.');
        if (onAssetsUpdated) onAssetsUpdated();
    };

    // --- SIGNATORY INFO MANAGEMENT ---
    const handleSaveSignatoryInfo = () => {
        setStoredSignatoryInfo(signatoryName, signatoryTitle);
        setAutoSignEnabled(autoSign);
        showFeedback('Paramètres du signataire et signature automatique enregistrés !');
        if (onAssetsUpdated) onAssetsUpdated();
    };

    // --- TEST PDF SPECIMEN ---
    const handleTestSpecimenPdf = async () => {
        try {
            const sampleData: RiskGridData = {
                eventName: 'Test Spécimen Signature DPS65',
                eventDate: getLocalDateString(),
                eventTimeStart: '09:00',
                eventTimeEnd: '17:00',
                eventLocation: 'Tarbes (65000)',
                organizerName: 'Club Organisateur Test',
                organizerContact: 'M. Martin DUPONT',
                organizerPhone: '06 12 34 56 78',
                organizerEmail: 'organisateur@test.com',
                qualiteRepresentant: 'Président du Club',
                activityType: 'Événement Test / Démonstration',
                publicCount: 600,
                participantsCount: 150,
                e1Value: 0.35,
                e1Label: 'Public debout : manifestation sportive avec séparation',
                e2Value: 0.30,
                e2Label: 'Terrain naturel plat < 2ha',
                tValue: 0.25,
                tLabel: 'Moins de 10 minutes',
                specificRisks: ['Spécimen de validation visuelle', 'Signature et logo officiels'],
                indiceI: 262,
                dispositifType: 'DPS-PE',
                recommendedSecouristes: 4,
                recommendedPse2: 2,
                recommendedPse1: 2,
                recommendedChefPoste: 1,
                recommendedChefSection: 0,
                recommendedVpsp: 1,
                notes: 'Vérification du rendu de la signature, du logo et du centrage du titre.',
                nbSecouristes: 4,
                nbChefsPoste: 1,
                nbVpsp: 1,
                hasChefPoste: true,
                hasVpsp: true,
                hasVehiculePersonnel: true,
                nbVehiculePersonnel: 1,
                signatoryName,
                signatoryTitle,
                signatureAssoBase64: signatureBase64 || undefined,
                autoSign
            };

            await generateRiskGridPdf(sampleData);
            showFeedback('Spécimen PDF généré et téléchargé avec succès !');
        } catch (e: any) {
            showFeedback(`Erreur lors de la génération du spécimen : ${e.message}`, 'error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Feedback Alert */}
            {feedbackMessage && (
                <div 
                    id="branding-feedback-banner"
                    className={`p-4 rounded-2xl flex items-center gap-3 border shadow-sm ${
                        feedbackMessage.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                            : 'bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                    }`}
                >
                    {feedbackMessage.type === 'success' ? (
                        <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                        <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
                    )}
                    <span className="font-bold text-sm">{feedbackMessage.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. SECTION LOGO DE L'ASSOCIATION (Col 5) */}
                <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between space-y-5">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-blue-500" /> Logo de l'Association
                            </h3>
                            {logoBase64 && (
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                    Personnalisé
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Ce logo apparaît automatiquement sur l'en-tête de la <strong>Grille d'évaluation des risques</strong> et de la <strong>Convention DPS</strong> (format carré ou rond recommandé).
                        </p>

                        {/* Zone d'affichage du Logo */}
                        <div className="mt-4 p-6 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center min-h-[170px]">
                            {logoBase64 ? (
                                <div className="space-y-3 flex flex-col items-center">
                                    <div className="w-24 h-24 rounded-2xl bg-white p-2 shadow-md border border-slate-200 flex items-center justify-center overflow-hidden">
                                        <img 
                                            src={logoBase64} 
                                            alt="Logo Association DPS65" 
                                            className="max-w-full max-h-full object-contain"
                                            referrerPolicy="no-referrer"
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Logo personnalisé actif</span>
                                </div>
                            ) : (
                                <div className="space-y-2 flex flex-col items-center">
                                    <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-sm border border-slate-200 flex items-center justify-center overflow-hidden">
                                        <img 
                                            src="/logo-dps65.png" 
                                            alt="Logo DPS65 par défaut" 
                                            className="max-w-full max-h-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                            }}
                                            referrerPolicy="no-referrer"
                                        />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Logo officiel DPS65 par défaut</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/50">
                        <input 
                            type="file" 
                            ref={logoInputRef} 
                            onChange={handleLogoUpload} 
                            accept="image/png, image/jpeg, image/svg+xml, image/webp" 
                            className="hidden" 
                        />
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            icon={<Upload className="w-4 h-4 text-blue-500" />}
                            onClick={() => logoInputRef.current?.click()}
                            className="flex-1 text-xs font-bold"
                        >
                            {logoBase64 ? 'Remplacer le Logo' : 'Importer mon Logo'}
                        </Button>
                        {logoBase64 && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                icon={<RotateCcw className="w-4 h-4 text-slate-500" />}
                                onClick={handleResetLogo}
                                title="Rétablir le logo par défaut"
                                className="text-xs"
                            >
                                Réinitialiser
                            </Button>
                        )}
                    </div>
                </div>

                {/* 2. SECTION SIGNATURE & CACHET ASSEMBLE (Col 7) */}
                <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                            <PenTool className="w-4 h-4 text-blue-500" /> Signature & Cachet Officiel de l'Association
                        </h3>
                        {signatureBase64 && (
                            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                                Signature Active
                            </span>
                        )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Cette signature sera <strong>automatiquement apposée</strong> dans le cadre réservé à l'association sur tous les documents PDF générés.
                    </p>

                    {/* Mode de saisie (Dessiner ou Importer) */}
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setSignatureMode('draw')}
                            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                signatureMode === 'draw'
                                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                            }`}
                        >
                            <PenTool className="w-3.5 h-3.5" /> Dessiner la signature
                        </button>
                        <button
                            type="button"
                            onClick={() => setSignatureMode('upload')}
                            className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                                signatureMode === 'upload'
                                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                            }`}
                        >
                            <Upload className="w-3.5 h-3.5" /> Importer une image (PNG / Cachet)
                        </button>
                    </div>

                    {signatureMode === 'draw' ? (
                        <div className="space-y-3">
                            {/* Contrôles du crayon */}
                            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[11px]">Couleur :</span>
                                    <div className="flex items-center gap-1.5">
                                        {[
                                            { color: '#1E3A8A', name: 'Bleu Marine' },
                                            { color: '#0F172A', name: 'Noir Ébène' },
                                            { color: '#1D4ED8', name: 'Bleu Royal' }
                                        ].map((c) => (
                                            <button
                                                key={c.color}
                                                type="button"
                                                onClick={() => setPenColor(c.color)}
                                                className={`w-5 h-5 rounded-full border-2 transition-all ${
                                                    penColor === c.color ? 'border-blue-500 scale-110 shadow-sm' : 'border-transparent'
                                                }`}
                                                style={{ backgroundColor: c.color }}
                                                title={c.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-[11px]">Épaisseur :</span>
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="5" 
                                        step="0.5"
                                        value={penSize} 
                                        onChange={(e) => setPenSize(parseFloat(e.target.value))}
                                        className="w-20 accent-blue-600"
                                    />
                                    <span className="text-[10px] font-mono text-slate-400">{penSize}px</span>
                                </div>
                            </div>

                            {/* Canvas de dessin */}
                            <div className="relative border-2 border-slate-300 dark:border-slate-600 rounded-2xl bg-white overflow-hidden shadow-inner touch-none">
                                <canvas
                                    ref={canvasRef}
                                    width={480}
                                    height={150}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="w-full h-[150px] cursor-crosshair block"
                                />
                                <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 select-none pointer-events-none">
                                    Signez à l'aide de la souris ou de votre écran tactile
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    icon={<Trash2 className="w-4 h-4 text-red-500" />}
                                    onClick={clearCanvas}
                                    className="text-xs"
                                >
                                    Effacer
                                </Button>

                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    icon={<Check className="w-4 h-4" />}
                                    onClick={saveDrawnSignature}
                                    className="text-xs font-bold bg-blue-600 hover:bg-blue-500"
                                >
                                    Enregistrer cette signature
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-6 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center min-h-[150px]">
                                {signatureBase64 ? (
                                    <div className="space-y-2 flex flex-col items-center">
                                        <div className="max-h-24 max-w-xs p-2 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center">
                                            <img 
                                                src={signatureBase64} 
                                                alt="Aperçu signature enregistrée" 
                                                className="max-h-20 object-contain"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Signature / Cachet actuellement actif</span>
                                    </div>
                                ) : (
                                    <div className="space-y-1 text-slate-400">
                                        <PenTool className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                                        <p className="text-xs font-medium">Aucune image de signature ou cachet importée</p>
                                        <p className="text-[11px] text-slate-400">Format PNG avec fond transparent conseillé</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <input 
                                    type="file" 
                                    ref={signatureInputRef} 
                                    onChange={handleSignatureUpload} 
                                    accept="image/png, image/jpeg, image/webp" 
                                    className="hidden" 
                                />
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    size="sm" 
                                    icon={<Upload className="w-4 h-4 text-blue-500" />}
                                    onClick={() => signatureInputRef.current?.click()}
                                    className="flex-1 text-xs font-bold"
                                >
                                    Sélectionner une image (PNG / JPG)
                                </Button>
                                {signatureBase64 && (
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        icon={<Trash2 className="w-4 h-4 text-red-500" />}
                                        onClick={handleDeleteSignature}
                                        className="text-xs text-red-600 hover:bg-red-50"
                                    >
                                        Supprimer
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. SECTION PARAMÈTRES DU SIGNATAIRE & VALIDATION (Plein large) */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
                    <h3 className="text-sm font-black uppercase text-slate-800 dark:text-white flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-blue-500" /> Renseignements du Signataire & Paramètres PDF
                    </h3>

                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        icon={<Download className="w-4 h-4 text-red-600" />}
                        onClick={handleTestSpecimenPdf}
                        className="text-xs font-bold border-red-200 hover:bg-red-50 text-red-700 dark:text-red-300 dark:bg-red-950/40"
                    >
                        Tester le rendu PDF (Spécimen)
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Nom du Responsable Opérationnel / Signataire
                        </label>
                        <input
                            type="text"
                            value={signatoryName}
                            onChange={(e) => setSignatoryName(e.target.value)}
                            placeholder="ex: Jean DUPONT ou Responsable Opérationnel DPS65"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Qualité / Fonction du Signataire
                        </label>
                        <input
                            type="text"
                            value={signatoryTitle}
                            onChange={(e) => setSignatoryTitle(e.target.value)}
                            placeholder="ex: Chef de Dispositif / Évaluateur Réglementaire"
                            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                {/* Option Toggle Signature Automatique */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="space-y-0.5 max-w-xl">
                        <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Apposition Automatique de la Signature
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Apposer automatiquement le logo, le nom du responsable et la signature enregistrée sur toutes les futures grilles de risques et conventions sans manipulation manuelle.
                        </p>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input 
                            type="checkbox" 
                            checked={autoSign} 
                            onChange={(e) => setAutoSign(e.target.checked)} 
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                    </label>
                </div>

                <div className="flex justify-end pt-2">
                    <Button
                        type="button"
                        variant="primary"
                        size="md"
                        icon={<Check className="w-4 h-4" />}
                        onClick={handleSaveSignatoryInfo}
                        className="bg-blue-600 hover:bg-blue-500 text-xs font-bold"
                    >
                        Enregistrer tous les paramètres
                    </Button>
                </div>
            </div>
        </div>
    );
};
