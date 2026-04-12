
export interface Track {
  id: string;
  name: string;
  data: [number, number][];
  color?: string;
}

export interface Event {
  id: string;
  name: string;
  date: string;
  location: string;
  createdAt: number;
  updatedAt?: number; // Delta Sync
  resourceConfig?: {
    totalStretchers: number;
    totalChairs: number;
  };
  supervisorName?: string;
  supervisorPhone?: string;
  trackData?: [number, number][]; // Tableau de coordonnées [lat, lng] pour le tracé GPX (Legacy)
  tracks?: Track[]; // NOUVEAU: Plusieurs tracés GPX
  organizer_code?: string; // Code d'accès pour l'organisateur
  mapPdfUrl?: string; // URL ou DataURL du PDF de cartographie détaillé
}

export interface TeamLocation {
  id: string;
  team_name: string;
  event_id?: string;
  lat: number;
  lng: number;
  accuracy: number;
  altitude?: number;
  timestamp: number;
  battery_level?: number;
  is_charging?: boolean;
}

export type MarkerType = 'POST' | 'VEHICLE' | 'QUAD' | 'DANGER' | 'POI' | 'TEAM';

export interface CustomMarker {
    id: string;
    eventId: string;
    lat: number;
    lng: number;
    label: string;
    type: MarkerType;
    createdAt: number;
}

export enum Outcome {
  TREATMENT_IN_PROGRESS = 'Traitement en cours',
  RELEASED = 'Sortie (Laissé sur place)',
  TRANSFER_TO_POST = 'Transfert vers Poste de Secours',
  EVACUATED_HOSPITAL = 'Évacuation Hôpital',
  REFUSED_CARE = 'Refus de soin',
  DECEASED = 'Décédé'
}

export enum TriageColor {
  UA = 'Rouge (UA)',
  UR = 'Jaune (UR)',
  UIP = 'Vert (UIP)',
  DCD = 'Noir (DCD)'
}

export interface Solute {
  id: string;
  name: string;
  time: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  time: string;
}

export interface VitalSign {
  id: string;
  time: string;
  pulse?: string;
  sao2?: string;
  bp?: string;
  glycemia?: string;
  temp?: string;
  eva?: string;
  expiryTime?: number; // Timestamp d'expiration des constantes
}

export interface CprEvent {
  timestamp: number;
  action: 'START' | 'STOP' | 'PAUSE' | 'RESUME' | 'CYCLE' | 'DRUG' | 'ANALYSIS' | 'ROSC';
  details?: string;
}

export interface VictimPhoto {
  id: string;
  victimId?: string; // Lien FK
  timestamp: number;
  dataUrl?: string; // Legacy Base64 (pour compatibilité)
  blob?: Blob; // Nouveau stockage binaire optimisé
  storagePath?: string; // Chemin dans Supabase Storage
  publicUrl?: string; // URL publique finale
  description?: string;
}

export interface ResponderEntry {
    id: string;
    timestamp: number;
    name: string;
    firstName: string;
    team: string;
}

export interface Victim {
  id: string;
  eventId: string;
  updatedAt?: number; // Delta Sync
  bibNumber: string;
  fullName: string;
  phoneNumber?: string;
  emergencyContact?: string;
  arrivalTime: string;
  careOnSiteTime?: string;
  departureTime?: string;
  reason: string;
  careProvided: string;
  allergies: string;
  treatments: string;
  outcome: Outcome;
  hospitalName?: string;
  deceasedDetails?: string;
  deceasedDate?: string;
  deceasedTime?: string;
  
  responderName?: string;
  responderFirstName?: string;
  responderTeam?: string;
  responderHistory?: ResponderEntry[];

  vitals?: VitalSign[];
  pulse?: string;
  sao2?: string;
  bp?: string;
  glycemia?: string;
  temp?: string;
  eva?: string;
  isAdvancedMode?: boolean;
  hasKt?: boolean;
  ktTime?: string;
  solutes?: Solute[];
  medications?: string;
  medicationsList?: Medication[];
  samuValidated?: boolean;
  signatureData?: string; 
  doctorSignatureData?: string; 
  triageColor?: TriageColor;
  resourceUsed?: 'stretcher' | 'chair' | 'none';
  cprHistory?: CprEvent[]; 
  cprStartTime?: number;
  cprDurationSeconds?: number;
  photos?: VictimPhoto[]; // Liste locale pour UI
  hasTourniquet?: boolean;
  tourniquetTime?: string;
}

export interface LogbookEntry {
  id: string;
  eventId: string | null;
  timestamp: number;
  message: string;
  category: 'INFO' | 'RADIO' | 'ALERTE' | 'MOUVEMENT' | 'AUTORITE' | 'ALERTE_GEN';
  author?: string;
}

export interface AppConfig {
  hospitals: string[]; 
  teams: string[];     
  voiceUri?: string;
  yaplaLink?: string; 
  signupCode?: string; // Code d'accès inscription
  medications?: string[];
  solutes?: string[];
}

export interface Mission {
    id: string;
    title: string;
    date: string;
    timeStart: string;
    timeEnd: string;
    location: string;
    type: 'DPS' | 'FORMATION' | 'REUNION' | 'AUTRE';
    requiredPse1: number;
    requiredPse2: number;
    requiredIde?: number; 
    requiredMed?: number; 
    registeredUserIds: string[];
    absentUserIds?: string[];
    reservistUserIds?: string[];
}

// --- GESTION VEHICULES ---

export interface VehicleTrackingPoint {
    id: string;
    label: string; 
    date: string; 
    type: 'CT' | 'SERVICE' | 'OTHER';
}

export interface VehicleDefinition {
    id: string;
    name: string;
    type: string;
    lastTechControl: string; 
    nextTechControl: string; 
    lastService: string;
    nextService: string; 
    customTracking?: VehicleTrackingPoint[]; 
}

export interface VehicleCheck {
    id: string;
    vehicleId: string;
    date: number;
    user: string;
    km: number;
    fuelLevel: number;
    cleanlinessInOut: boolean;
    cleanlinessOut: boolean;
    alerts: string[];
}

// --- GESTION VESTIAIRE ---
export interface UniformSizes {
    top: string;      
    bottom: string;   
    shoes: string;    
    head?: string;    
}

export interface UniformItem {
    type: 'TSHIRT' | 'POLO' | 'POLAIRE' | 'SOFTSHELL' | 'PANTALON' | 'CASQUETTE' | 'CHAUSSURES';
    label: string;
    hasItem: boolean;
    condition?: 'NEUF' | 'BON' | 'USÉ' | 'HS';
    requestedQty: number; 
}

export interface UserUniformData {
    id: string; // user_id
    sizes: UniformSizes;
    items: UniformItem[];
    lastUpdated: number;
}

// --- GESTION SACS & STOCK ---
export type BagType = 'LOT_A' | 'LOT_B' | 'LOT_C' | 'SAC_IDE';

export interface Bag {
    id: string; 
    name: string; 
    description?: string; 
    type: BagType;
    assignedTeam?: string; 
    lastCheckedDate?: number;
}

export interface BagItem {
    id: string;
    bagId: string;
    name: string;
    quantity: number;
    targetQuantity: number; 
    expiryDate?: string; 
    batchNumber?: string;
}

export interface BagConsumption {
    id: string;
    bagId: string;
    itemName: string;
    quantity: number;
    timestamp: number;
    eventId?: string;
    user: string;
}

// --- GESTION UTILISATEURS ---
export type UserRole = 'admin' | 'secouriste' | 'infirmier' | 'medecin' | 'logisticien' | 'snu' | 'stagiaire' | 'organisateur';

export interface Diploma {
    id: string;
    name: string;
    dateObtained: string; // YYYY-MM-DD
    expiresAt?: string;   // YYYY-MM-DD (Optionnel pour diplômes à vie)
}

export interface UserProfile {
    id: string; 
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string;
    // Qualifications legacy (gardé pour compatibilité, mais on utilise diplomas)
    qualifications?: {
        pse1: string;
        pse2: string;
        bnssa?: string;
    };
    diplomas?: Diploma[]; // NOUVEAU CHAMP
    points?: number;
    lockedFields?: string[]; 
    membershipExpiry?: string; 
    password?: string; // Pour auth locale
}

export interface NewsPost {
    id: string;
    date: number;
    title: string;
    content: string;
    author: string;
    isUrgent?: boolean;
}

export interface AssociationDocument {
    id: string;
    title: string;
    category: string;
    url: string;
    date: number;
    adminOnly?: boolean; // Visible uniquement par les admins
}

export interface QuizQuestion {
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
}

export interface DailyQuiz {
    date: string;
    theme: string;
    questions: QuizQuestion[];
    targetRole?: string;
}

export interface TrainingCourse {
    id: string;
    title: string;
    description: string;
    category: string; // Changed from enum to string to allow custom "Autre" input
    type: string;     // Changed from enum to string to allow custom "Autre" input
    duration?: string;
    date: string;
    url?: string;
}

export type AuditAction = 'LOGIN' | 'CREATE_EVENT' | 'DELETE_EVENT' | 'ARCHIVE_EVENT' | 'CREATE_VICTIM' | 'UPDATE_VICTIM' | 'DELETE_VICTIM' | 'EXPORT_PDF' | 'EXPORT_GLOBAL' | 'WIPE_DATA' | 'FACTORY_RESET' | 'BACKUP_EXPORT' | 'BACKUP_IMPORT' | 'CONFIG_UPDATE' | 'LOGBOOK_ADD' | 'REMOTE_WIPE_TRIGGERED' | 'EXPORT_CSV' | 'AI_QUERY' | 'CHAT_MSG' | 'VEHICLE_CHECK' | 'MISSION_SIGNUP' | 'BAG_ASSIGN' | 'BAG_CONSUME' | 'UNIFORM_UPDATE' | 'SYNC_ERROR';

export interface AuditLog {
  id: string;
  timestamp: number;
  action: AuditAction;
  details: string;
  userHash?: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
