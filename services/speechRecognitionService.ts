import { GoogleGenAI } from '@google/genai';

export interface SpeechRecognitionOptions {
    lang?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onResult?: (transcript: string) => void;
    onError?: (error: string) => void;
}

export class SpeechRecognitionHandler {
    private isListening: boolean = false;
    private recognition: any = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private options: SpeechRecognitionOptions = {};

    constructor(options: SpeechRecognitionOptions) {
        this.options = options;
    }

    public async start() {
        if (this.isListening) return;

        // 1. Demander explicitement la permission microphone via getUserMedia
        // Cela déclenche la popup de permission Android dans le WebView Capacitor
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err: any) {
            console.error("Accès au microphone refusé:", err);
            if (this.options.onError) {
                this.options.onError("Accès au microphone refusé par l'appareil.");
            }
            if (this.options.onEnd) this.options.onEnd();
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        // 2. Tester d'abord l'API Web Speech native (PWA iOS Safari, Chrome Desktop, etc.)
        if (SpeechRecognition) {
            try {
                const rec = new SpeechRecognition();
                rec.lang = this.options.lang || 'fr-FR';
                rec.continuous = false;
                rec.interimResults = false;

                let hasResult = false;

                rec.onstart = () => {
                    this.isListening = true;
                    if (this.options.onStart) this.options.onStart();
                };

                rec.onresult = (e: any) => {
                    hasResult = true;
                    const transcript = e.results[0][0].transcript;
                    if (this.options.onResult) this.options.onResult(transcript);
                };

                rec.onerror = (e: any) => {
                    console.warn("WebSpeech API Warning/Error:", e.error);
                    // Sur Android WebView (Capacitor), service-not-allowed ou not-allowed ou network sont fréquents.
                    // En cas de blocage WebView, basculer de manière transparente sur l'enregistreur audio + Gemini
                    if (!hasResult && (e.error === 'service-not-allowed' || e.error === 'not-allowed' || e.error === 'audio-capture' || e.error === 'network' || e.error === 'no-speech')) {
                        console.log("Basculement automatique sur la dictée audio Gemini pour Android WebView...");
                        try { rec.stop(); } catch(err) {}
                        this.startMediaRecorderFallback();
                    } else {
                        this.stop();
                        if (this.options.onError) {
                            this.options.onError(`Erreur dictée: ${e.error}`);
                        }
                    }
                };

                rec.onend = () => {
                    if (!this.mediaRecorder) {
                        this.isListening = false;
                        this.cleanupStream();
                        if (this.options.onEnd) this.options.onEnd();
                    }
                };

                this.recognition = rec;
                rec.start();
                return;
            } catch (err) {
                console.warn("Erreur d'initialisation SpeechRecognition, fallback MediaRecorder", err);
            }
        }

        // 3. Si Web Speech API n'est pas disponible, basculer directement sur MediaRecorder
        this.startMediaRecorderFallback();
    }

    private async startMediaRecorderFallback() {
        if (!this.stream) return;
        try {
            this.audioChunks = [];
            const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
                ? 'audio/webm' 
                : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');

            const options = mimeType ? { mimeType } : undefined;
            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    this.audioChunks.push(e.data);
                }
            };

            this.mediaRecorder.onstart = () => {
                this.isListening = true;
                if (this.options.onStart) this.options.onStart();
            };

            this.mediaRecorder.onstop = async () => {
                this.isListening = false;
                const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
                this.cleanupStream();

                if (audioBlob.size > 0) {
                    await this.transcribeAudioWithGemini(audioBlob);
                }

                if (this.options.onEnd) this.options.onEnd();
            };

            this.mediaRecorder.start();
        } catch (e: any) {
            console.error("Erreur fallback MediaRecorder:", e);
            this.isListening = false;
            this.cleanupStream();
            if (this.options.onError) this.options.onError("Dictée vocale non supportée.");
            if (this.options.onEnd) this.options.onEnd();
        }
    }

    private async transcribeAudioWithGemini(audioBlob: Blob) {
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                if (this.options.onError) this.options.onError("Clé API Gemini indisponible.");
                return;
            }

            const arrayBuffer = await audioBlob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Audio = btoa(binary);

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        inlineData: {
                            mimeType: audioBlob.type || 'audio/webm',
                            data: base64Audio
                        }
                    },
                    {
                        text: "Transcris exactement le message vocal audio ci-joint en texte en français. Renvoie uniquement le texte transcrit sans salutations ni commentaires."
                    }
                ]
            });

            const transcript = response.text?.trim();
            if (transcript && this.options.onResult) {
                this.options.onResult(transcript);
            }
        } catch (err: any) {
            console.error("Erreur de transcription audio Gemini:", err);
            if (this.options.onError) {
                this.options.onError("Impossible de transcrire le message vocal.");
            }
        }
    }

    public stop() {
        if (this.recognition) {
            try { this.recognition.stop(); } catch(e) {}
            this.recognition = null;
        }

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            try { this.mediaRecorder.stop(); } catch(e) {}
        }

        this.isListening = false;
        this.cleanupStream();
    }

    private cleanupStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}
