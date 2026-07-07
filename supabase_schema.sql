-- ====================================================================
-- DPS65 - SCHEMA TECHNIQUE FINAL POUR SUPABASE (POSTGRESQL 15+)
-- Généré par l'Expert Supabase/PostgreSQL Senior DPS65
-- ====================================================================

-- ----------------------------------------------------
-- 0. ACQUITTEMENT DES EXTENSIONS REQUISES
-- ----------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------
-- 1. TYPES ENUM ET DOMAINES CONSTRAINTS
-- ----------------------------------------------------
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'admin', 'secouriste', 'infirmier', 'medecin', 'logisticien', 'snu', 'stagiaire', 'organisateur'
        );
    END IF;
END $$;

-- ----------------------------------------------------
-- 2. STRUCTURES DE TABLES (DDL)
-- ----------------------------------------------------

-- TABLE: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    role public.user_role NOT NULL DEFAULT 'secouriste',
    "firstName" TEXT,
    "lastName" TEXT,
    phone TEXT,
    qualifications JSONB DEFAULT '{}'::jsonb,
    diplomas JSONB DEFAULT '[]'::jsonb,
    points INTEGER DEFAULT 0,
    "lockedFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "membershipExpiry" TEXT
);

-- TABLE: events
CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    date TEXT NOT NULL, -- Format YYYY-MM-DD
    location TEXT NOT NULL,
    "createdAt" BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    "updatedAt" BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    "resourceConfig" JSONB DEFAULT '{"totalStretchers": 0, "totalChairs": 0}'::jsonb,
    "supervisorName" TEXT,
    "supervisorPhone" TEXT,
    "trackData" JSONB DEFAULT '[]'::jsonb,
    tracks JSONB DEFAULT '[]'::jsonb,
    organizer_code TEXT,
    "mapPdfUrl" TEXT,
    "mapPdfs" JSONB DEFAULT '[]'::jsonb
);

-- TABLE: victims
CREATE TABLE IF NOT EXISTS public.victims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    "updatedAt" BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint,
    "bibNumber" TEXT DEFAULT '',
    "fullName" TEXT NOT NULL,
    "birthDate" TEXT,
    "phoneNumber" TEXT,
    "emergencyContact" TEXT,
    "arrivalTime" TEXT NOT NULL,
    "careOnSiteTime" TEXT,
    "departureTime" TEXT,
    reason TEXT NOT NULL,
    "careProvided" TEXT DEFAULT '',
    allergies TEXT DEFAULT 'Inconnu',
    treatments TEXT DEFAULT 'Inconnu',
    outcome TEXT NOT NULL DEFAULT 'Traitement en cours',
    "hospitalName" TEXT,
    "deceasedDetails" TEXT,
    "deceasedDate" TEXT,
    "deceasedTime" TEXT,
    "responderName" TEXT,
    "responderFirstName" TEXT,
    "responderTeam" TEXT,
    "responderHistory" JSONB DEFAULT '[]'::jsonb,
    vitals JSONB DEFAULT '[]'::jsonb,
    pulse TEXT,
    sao2 TEXT,
    bp TEXT,
    glycemia TEXT,
    temp TEXT,
    eva TEXT,
    "isAdvancedMode" BOOLEAN DEFAULT false,
    "hasKt" BOOLEAN DEFAULT false,
    "ktTime" TEXT,
    solutes JSONB DEFAULT '[]'::jsonb,
    medications TEXT,
    "medicationsList" JSONB DEFAULT '[]'::jsonb,
    "samuValidated" BOOLEAN DEFAULT false,
    "signatureData" TEXT,
    "doctorSignatureData" TEXT,
    "triageColor" TEXT,
    "resourceUsed" TEXT DEFAULT 'none',
    "cprHistory" JSONB DEFAULT '[]'::jsonb,
    "cprStartTime" BIGINT,
    "cprDurationSeconds" INTEGER,
    "hasTourniquet" BOOLEAN DEFAULT false,
    "tourniquetTime" TEXT
);

-- TABLE: logbook (Communications & Logs d'Intervention)
CREATE TABLE IF NOT EXISTS public.logbook (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    message TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('INFO', 'RADIO', 'ALERTE', 'MOUVEMENT', 'AUTORITE', 'ALERTE_GEN')),
    author TEXT
);

-- TABLE: team_locations
CREATE TABLE IF NOT EXISTS public.team_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name TEXT NOT NULL,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    battery_level INTEGER,
    is_charging BOOLEAN
);

-- TABLE: custom_markers
CREATE TABLE IF NOT EXISTS public.custom_markers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    label TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('POST', 'VEHICLE', 'QUAD', 'DANGER', 'POI', 'TEAM')),
    "createdAt" BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- TABLE: missions
CREATE TABLE IF NOT EXISTS public.missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    date TEXT NOT NULL, -- Format YYYY-MM-DD
    "timeStart" TEXT NOT NULL,
    "timeEnd" TEXT NOT NULL,
    location TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('DPS', 'FORMATION', 'REUNION', 'AUTRE')),
    "requiredPse1" INTEGER DEFAULT 0,
    "requiredPse2" INTEGER DEFAULT 0,
    "requiredIde" INTEGER DEFAULT 0,
    "requiredMed" INTEGER DEFAULT 0,
    "registeredUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "absentUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reservistUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- TABLE: bags
CREATE TABLE IF NOT EXISTS public.bags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('LOT_A', 'LOT_B', 'LOT_C', 'SAC_IDE')),
    "assignedTeam" TEXT DEFAULT 'DEPOT',
    "lastCheckedDate" BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- TABLE: bag_items
CREATE TABLE IF NOT EXISTS public.bag_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "bagId" UUID REFERENCES public.bags(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    "targetQuantity" INTEGER NOT NULL DEFAULT 0,
    "expiryDate" TEXT,
    "batchNumber" TEXT
);

-- TABLE: uniforms
CREATE TABLE IF NOT EXISTS public.uniforms (
    id UUID PRIMARY KEY, -- Référence à profiles.id
    sizes JSONB NOT NULL DEFAULT '{"top": "", "bottom": "", "shoes": ""}'::jsonb,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    "lastUpdated" BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- TABLE: fleet (Véhicules)
CREATE TABLE IF NOT EXISTS public.fleet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    "lastTechControl" TEXT,
    "nextTechControl" TEXT,
    "lastService" TEXT,
    "nextService" TEXT,
    "customTracking" JSONB DEFAULT '[]'::jsonb
);

-- TABLE: vehicle_checks
CREATE TABLE IF NOT EXISTS public.vehicle_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "vehicleId" UUID REFERENCES public.fleet(id) ON DELETE CASCADE,
    date BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    "user" TEXT NOT NULL,
    km DOUBLE PRECISION NOT NULL,
    "fuelLevel" INTEGER NOT NULL,
    "cleanlinessInOut" BOOLEAN NOT NULL DEFAULT true,
    "cleanlinessOut" BOOLEAN NOT NULL DEFAULT true,
    alerts TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- TABLE: news
CREATE TABLE IF NOT EXISTS public.news (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    "isUrgent" BOOLEAN DEFAULT false
);

-- TABLE: documents
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    url TEXT NOT NULL,
    date BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    "adminOnly" BOOLEAN DEFAULT false
);

-- TABLE: courses
CREATE TABLE IF NOT EXISTS public.courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    type TEXT NOT NULL,
    duration TEXT,
    date TEXT NOT NULL,
    url TEXT
);

-- TABLE: config
CREATE TABLE IF NOT EXISTS public.config (
    id TEXT PRIMARY KEY DEFAULT 'main',
    hospitals TEXT[] DEFAULT '{}'::text[],
    teams TEXT[] DEFAULT '{}'::text[],
    "voiceUri" TEXT DEFAULT '',
    "yaplaLink" TEXT DEFAULT '',
    "signupCode" TEXT DEFAULT 'DPS65-2025',
    medications TEXT[] DEFAULT '{}'::text[],
    solutes TEXT[] DEFAULT '{}'::text[],
    "forcedUpdateAt" TEXT DEFAULT ''
);

-- TABLE: audit (Optionnelle au cas où on voudrait sauvegarder les logs d'audit sur le cloud)
CREATE TABLE IF NOT EXISTS public.audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    "userHash" TEXT
);

-- ----------------------------------------------------
-- 3. PERFORMANCES & STRUCTURES D'INDEXATION
-- ----------------------------------------------------

-- Index d'événements
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(date);

-- Index de victimes
CREATE INDEX IF NOT EXISTS idx_victims_event_id ON public.victims(event_id);
CREATE INDEX IF NOT EXISTS idx_victims_triage_color ON public.victims("triageColor");
CREATE INDEX IF NOT EXISTS idx_victims_updated_at ON public.victims("updatedAt");

-- Index logbook
CREATE INDEX IF NOT EXISTS idx_logbook_event_id ON public.logbook(event_id);
CREATE INDEX IF NOT EXISTS idx_logbook_timestamp ON public.logbook(timestamp);

-- Index team locations (géolocalisation)
CREATE INDEX IF NOT EXISTS idx_team_locations_event_id ON public.team_locations(event_id);
CREATE INDEX IF NOT EXISTS idx_team_locations_timestamp ON public.team_locations(timestamp);

-- Index matériel & sac
CREATE INDEX IF NOT EXISTS idx_bag_items_bag_id ON public.bag_items("bagId");
CREATE INDEX IF NOT EXISTS idx_vehicle_checks_vehicle_id ON public.vehicle_checks("vehicleId");

-- Index missions
CREATE INDEX IF NOT EXISTS idx_missions_date ON public.missions(date);

-- Index custom markers
CREATE INDEX IF NOT EXISTS idx_custom_markers_event_id ON public.custom_markers(event_id);

-- ----------------------------------------------------
-- 4. LOGIQUE DES TRIGGERS POUR LA GESTION DU TEMPS MODIFICATION (Delta Sync)
-- ----------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp_ms()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = (extract(epoch from now()) * 1000)::bigint;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger sur events
DROP TRIGGER IF EXISTS trigger_set_events_updated_at ON public.events;
CREATE TRIGGER trigger_set_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp_ms();

-- Application du trigger sur victims
DROP TRIGGER IF EXISTS trigger_set_victims_updated_at ON public.victims;
CREATE TRIGGER trigger_set_victims_updated_at
    BEFORE UPDATE ON public.victims
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp_ms();


-- ----------------------------------------------------
-- 5. ACCES AUX RÔLES & SÉCURITÉ DE HAUT NIVEAU
-- ----------------------------------------------------

-- Activation globale de la Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.victims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bag_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uniforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- 6. FONCTIONS DE SÉCURITÉ ET RPC UTILS
-- ----------------------------------------------------

-- Helper pour récupérer facilement le rôle de l'utilisateur actif
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
    u_role TEXT;
BEGIN
    SELECT role::text INTO u_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(u_role, 'stagiaire');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ----------------------------------------------------
-- 7. POLICIES RLS (POLITIQUES DE SÉCURITÉ)
-- ----------------------------------------------------

-- ----------------- TABLE: PROFILES -----------------
CREATE POLICY select_profiles ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY update_own_profile ON public.profiles
    FOR UPDATE TO authenticated 
    USING (auth.uid() = id OR public.current_user_role() = 'admin')
    WITH CHECK (auth.uid() = id OR public.current_user_role() = 'admin');

CREATE POLICY insert_profiles ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() = 'admin' OR auth.uid() = id);

CREATE POLICY delete_profiles ON public.profiles
    FOR DELETE TO authenticated
    USING (public.current_user_role() = 'admin');

-- ----------------- TABLE: EVENTS -----------------
CREATE POLICY select_events ON public.events
    FOR SELECT TO authenticated USING (true);

CREATE POLICY modify_events ON public.events
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- ----------------- TABLE: VICTIMS (Données Sensibles) -----------------
CREATE POLICY select_victims ON public.victims
    FOR SELECT TO authenticated 
    USING (public.current_user_role() IN ('admin', 'secouriste', 'infirmier', 'medecin', 'logisticien', 'organisateur'));

CREATE POLICY write_victims ON public.victims
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() IN ('admin', 'secouriste', 'infirmier', 'medecin'));

CREATE POLICY update_victims ON public.victims
    FOR UPDATE TO authenticated
    USING (public.current_user_role() IN ('admin', 'secouriste', 'infirmier', 'medecin'))
    WITH CHECK (public.current_user_role() IN ('admin', 'secouriste', 'infirmier', 'medecin'));

CREATE POLICY delete_victims ON public.victims
    FOR DELETE TO authenticated
    USING (public.current_user_role() IN ('admin', 'secouriste', 'infirmier', 'medecin'));

-- ----------------- TABLE: LOGBOOK -----------------
CREATE POLICY select_logbook ON public.logbook
    FOR SELECT TO authenticated USING (true);

CREATE POLICY write_logbook ON public.logbook
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY modify_logbook ON public.logbook
    FOR UPDATE TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

CREATE POLICY delete_logbook ON public.logbook
    FOR DELETE TO authenticated
    USING (public.current_user_role() = 'admin');

-- ----------------- TABLE: TEAM LOCATIONS (GPS) -----------------
CREATE POLICY select_locations ON public.team_locations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY write_locations ON public.team_locations
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY update_locations ON public.team_locations
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY delete_locations ON public.team_locations
    FOR DELETE TO authenticated
    USING (public.current_user_role() = 'admin');

-- ----------------- TABLE: CUSTOM MARKERS -----------------
CREATE POLICY select_custom_markers ON public.custom_markers
    FOR SELECT TO authenticated USING (true);

CREATE POLICY write_custom_markers ON public.custom_markers
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY update_custom_markers ON public.custom_markers
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY delete_custom_markers ON public.custom_markers
    FOR DELETE TO authenticated
    USING (true);

-- ----------------- TABLE: MISSIONS -----------------
CREATE POLICY select_missions ON public.missions
    FOR SELECT TO authenticated USING (true);

-- Les secouristes ont le droit de s'inscrire à une mission (ce qui implique un update de la ligne)
CREATE POLICY update_missions ON public.missions
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY admin_modify_missions ON public.missions
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- ----------------- TABLE: BAGS -----------------
CREATE POLICY select_bags ON public.bags
    FOR SELECT TO authenticated USING (true);

CREATE POLICY modify_bags ON public.bags
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'logisticien'))
    WITH CHECK (public.current_user_role() IN ('admin', 'logisticien'));

-- ----------------- TABLE: BAG ITEMS -----------------
CREATE POLICY select_bag_items ON public.bag_items
    FOR SELECT TO authenticated USING (true);

-- Les secouristes peuvent consommer des items, ce qui met à jour la quantité
CREATE POLICY update_bag_items ON public.bag_items
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY admin_modify_bag_items ON public.bag_items
    FOR INSERT TO authenticated
    WITH CHECK (public.current_user_role() IN ('admin', 'logisticien'));

CREATE POLICY admin_delete_bag_items ON public.bag_items
    FOR DELETE TO authenticated
    USING (public.current_user_role() IN ('admin', 'logisticien'));

-- ----------------- TABLE: UNIFORMS -----------------
CREATE POLICY select_uniforms ON public.uniforms
    FOR SELECT TO authenticated
    USING (public.current_user_role() IN ('admin', 'logisticien') OR auth.uid() = id);

CREATE POLICY modify_uniforms ON public.uniforms
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'logisticien') OR auth.uid() = id)
    WITH CHECK (public.current_user_role() IN ('admin', 'logisticien') OR auth.uid() = id);

-- ----------------- TABLE: FLEET -----------------
CREATE POLICY select_fleet ON public.fleet
    FOR SELECT TO authenticated USING (true);

CREATE POLICY modify_fleet ON public.fleet
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'logisticien'))
    WITH CHECK (public.current_user_role() IN ('admin', 'logisticien'));

-- ----------------- TABLE: VEHICLE CHECKS -----------------
CREATE POLICY select_vehicle_checks ON public.vehicle_checks
    FOR SELECT TO authenticated USING (true);

CREATE POLICY write_vehicle_checks ON public.vehicle_checks
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY modify_vehicle_checks ON public.vehicle_checks
    FOR ALL TO authenticated
    USING (public.current_user_role() IN ('admin', 'logisticien'))
    WITH CHECK (public.current_user_role() IN ('admin', 'logisticien'));

-- ----------------- TABLE: NEWS -----------------
CREATE POLICY select_news ON public.news
    FOR SELECT TO authenticated USING (true);

CREATE POLICY modify_news ON public.news
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- ----------------- TABLE: DOCUMENTS -----------------
CREATE POLICY select_documents ON public.documents
    FOR SELECT TO authenticated
    USING (NOT "adminOnly" OR public.current_user_role() = 'admin');

CREATE POLICY modify_documents ON public.documents
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- ----------------- TABLE: COURSES -----------------
CREATE POLICY select_courses ON public.courses
    FOR SELECT TO authenticated USING (true);

CREATE POLICY modify_courses ON public.courses
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- ----------------- TABLE: CONFIG -----------------
CREATE POLICY select_config ON public.config
    FOR SELECT TO authenticated USING (true);

CREATE POLICY modify_config ON public.config
    FOR ALL TO authenticated
    USING (public.current_user_role() = 'admin')
    WITH CHECK (public.current_user_role() = 'admin');

-- ----------------- TABLE: AUDIT -----------------
CREATE POLICY select_audit ON public.audit
    FOR SELECT TO authenticated
    USING (public.current_user_role() = 'admin');

CREATE POLICY write_audit ON public.audit
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- ----------------------------------------------------
-- 8. INTEGRATION DES TRIGGERS D'AUTHENTICATION (AUTOMATIQUE)
-- ----------------------------------------------------

-- Automatiser la création d'un profil public lorsqu'un utilisateur s'enregistre via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role, "firstName", "lastName", phone, points)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'secouriste'::public.user_role),
        COALESCE(NEW.raw_user_meta_data->>'firstName', 'Nouveau'),
        COALESCE(NEW.raw_user_meta_data->>'lastName', 'Secouriste'),
        NEW.phone,
        0
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        "firstName" = EXCLUDED."firstName",
        "lastName" = EXCLUDED."lastName";
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger sur auth.users
DROP TRIGGER IF EXISTS trigger_on_user_signup ON auth.users;
CREATE TRIGGER trigger_on_user_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();


-- ----------------------------------------------------
-- 9. CRÉATION DU STORAGE BUCKET POUR LES PHOTOS VICTIMES
-- ----------------------------------------------------
-- Permet l'envoi de photos via un bucket "victim_photos" dans Supabase Storage si activé
INSERT INTO storage.buckets (id, name, public) 
VALUES ('victim_photos', 'victim_photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket de stockage
DROP POLICY IF EXISTS "select_victim_photos" ON storage.objects;
CREATE POLICY "select_victim_photos" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'victim_photos');

DROP POLICY IF EXISTS "insert_victim_photos" ON storage.objects;
CREATE POLICY "insert_victim_photos" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'victim_photos');

DROP POLICY IF EXISTS "delete_victim_photos" ON storage.objects;
CREATE POLICY "delete_victim_photos" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'victim_photos' AND public.current_user_role() = 'admin');


-- ----------------------------------------------------
-- 10. CONFIGURATION DU TEMPS RÉEL & CDC (SUPABASE REALTIME)
-- ----------------------------------------------------

-- Activation de l'identité de réplication complète pour toutes les tables.
-- Cela garantit que toutes les colonnes (nouvelles et anciennes) sont incluses dans les logs de réplication (nécessaire pour les UPDATE et les DELETE)
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.victims REPLICA IDENTITY FULL;
ALTER TABLE public.logbook REPLICA IDENTITY FULL;
ALTER TABLE public.team_locations REPLICA IDENTITY FULL;
ALTER TABLE public.custom_markers REPLICA IDENTITY FULL;
ALTER TABLE public.missions REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.bags REPLICA IDENTITY FULL;
ALTER TABLE public.bag_items REPLICA IDENTITY FULL;
ALTER TABLE public.uniforms REPLICA IDENTITY FULL;
ALTER TABLE public.fleet REPLICA IDENTITY FULL;
ALTER TABLE public.news REPLICA IDENTITY FULL;
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.courses REPLICA IDENTITY FULL;
ALTER TABLE public.vehicle_checks REPLICA IDENTITY FULL;
ALTER TABLE public.config REPLICA IDENTITY FULL;

-- Ajout sécurisé et idempotent des tables à la publication de temps réel 'supabase_realtime'
DO $$
DECLARE
    t text;
    tables_to_add text[] := ARRAY[
        'events', 'victims', 'logbook', 'team_locations', 'custom_markers', 
        'missions', 'profiles', 'bags', 'bag_items', 'uniforms', 
        'fleet', 'news', 'documents', 'courses', 'vehicle_checks', 'config'
    ];
BEGIN
    -- Crée la publication 'supabase_realtime' si elle n'existe pas encore (scénario offline/self-hosted)
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- Ajoute chaque table de manière individuelle s'il n'est pas déjà présent
    FOREACH t IN ARRAY tables_to_add LOOP
        IF NOT EXISTS (
            SELECT 1 
            FROM pg_publication_rel pr
            JOIN pg_class c ON pr.prrelid = c.oid
            JOIN pg_namespace n ON c.relnamespace = n.oid
            JOIN pg_publication p ON pr.prpubid = p.oid
            WHERE p.pubname = 'supabase_realtime' 
              AND n.nspname = 'public' 
              AND c.relname = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;


-- =========================================================================
-- SECURE ORGANIZER RPC FUNCTIONS (SECURITY DEFINER to bypass RLS safely)
-- =========================================================================

-- RPC 1: Récupérer un événement via son code organisateur
CREATE OR REPLACE FUNCTION public.get_event_by_organizer_code(code_param TEXT)
RETURNS SETOF public.events AS $$
BEGIN
    RETURN QUERY 
    SELECT * FROM public.events 
    WHERE UPPER(TRIM(organizer_code)) = UPPER(TRIM(code_param));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC 2: Récupérer les victimes d'un événement via son code organisateur
CREATE OR REPLACE FUNCTION public.get_victims_by_organizer_code(event_id_param UUID, code_param TEXT)
RETURNS SETOF public.victims AS $$
BEGIN
    -- On vérifie que le code correspond bien à l'événement demandé pour assurer la sécurité
    IF EXISTS (
        SELECT 1 FROM public.events 
        WHERE id = event_id_param AND UPPER(TRIM(organizer_code)) = UPPER(TRIM(code_param))
    ) THEN
        RETURN QUERY 
        SELECT * FROM public.victims 
        WHERE event_id = event_id_param;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


