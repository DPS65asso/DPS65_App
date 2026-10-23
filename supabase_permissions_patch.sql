-- ====================================================================
-- DPS65 - SCRIPT DE SÉCURISATION DES PERMISSIONS SUPABASE (POSTGRESQL 15+)
-- Correctif pour la suppression des GRANT automatiques sur les tables du schéma public
-- ====================================================================
-- Ce script est 100% idempotent (peut être rejoué sans risque d'erreur).
-- À exécuter directement dans le SQL Editor de votre projet Supabase.

-- ----------------------------------------------------
-- 1. USAGE SUR LE SCHÉMA PUBLIC ET LES TYPES PERSONNALISÉS
-- ----------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Attribution du droit d'usage sur le type enum personnalisé 'user_role' (syntaxe standard PostgreSQL)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        GRANT USAGE ON TYPE public.user_role TO anon, authenticated, service_role;
    END IF;
END $$;

-- ----------------------------------------------------
-- 2. ACCÈS TOTAL ADMINISTRATIF : SERVICE_ROLE
-- ----------------------------------------------------
-- Le rôle service_role est utilisé pour les scripts serveurs et opérations d'administration internes.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

-- ----------------------------------------------------
-- 3. PERMISSIONS TABLE PAR TABLE (MOINDRE PRIVILÈGE)
-- ----------------------------------------------------

-- TABLE: profiles
-- Utilisateurs et secouristes de l'association
-- anon : aucun droit (isolation stricte des comptes)
-- authenticated : SELECT, INSERT, UPDATE, DELETE (gouverné par RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;

-- TABLE: events
-- Événements et dispositifs prévisionnels de secours (DPS)
-- anon : SELECT (affichage public des événements, plans et fiches mission)
-- authenticated : SELECT, INSERT, UPDATE, DELETE (création/gestion par secouristes et admins)
GRANT SELECT ON TABLE public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO authenticated;

-- TABLE: victims
-- Fiches de prise en charge et constantes médicales sensibles
-- anon : aucun droit direct (les organisateurs utilisent la RPC sécurisée)
-- authenticated : SELECT, INSERT, UPDATE, DELETE (gouverné par RLS médical)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.victims TO authenticated;

-- TABLE: logbook
-- Main courante et transmissions radio
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.logbook TO authenticated;

-- TABLE: team_locations
-- Géolocalisation opérationnelle des équipes
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.team_locations TO authenticated;

-- TABLE: custom_markers
-- Balises cartographiques tactiques
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_markers TO authenticated;

-- TABLE: missions
-- Calendrier et planning des missions
-- anon : SELECT (consultation publique des dates/horaires)
-- authenticated : SELECT, INSERT, UPDATE, DELETE (inscriptions et gestion)
GRANT SELECT ON TABLE public.missions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.missions TO authenticated;

-- TABLE: bags
-- Lots de secours (Lot A, B, C, Sac IDE)
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bags TO authenticated;

-- TABLE: bag_items
-- Contenu des sacs de secours et matériel
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.bag_items TO authenticated;

-- TABLE: uniforms
-- Vestiaire et dotation des tenues secouristes
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.uniforms TO authenticated;

-- TABLE: fleet
-- Véhicules d'intervention
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fleet TO authenticated;

-- TABLE: vehicle_checks
-- Fiches de vérification des véhicules
-- anon : aucun droit
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicle_checks TO authenticated;

-- TABLE: news
-- Actualités et alertes associatives
-- anon : SELECT (lecture des actualités publiques)
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT ON TABLE public.news TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.news TO authenticated;

-- TABLE: documents
-- Guides et procédures associatives
-- anon : SELECT (lecture des documents publics)
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT ON TABLE public.documents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents TO authenticated;

-- TABLE: courses
-- Catalogue des formations secouristes
-- anon : SELECT (lecture des formations disponibles)
-- authenticated : SELECT, INSERT, UPDATE, DELETE
GRANT SELECT ON TABLE public.courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.courses TO authenticated;

-- TABLE: config
-- Configuration générale de l'application
-- anon : SELECT (CRITIQUE : vérification du signupCode lors de l'inscription avant connexion)
-- authenticated : SELECT, INSERT, UPDATE, DELETE (gestion administrateur)
GRANT SELECT ON TABLE public.config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.config TO authenticated;

-- TABLE: audit
-- Journal des actions d'audit
-- anon : aucun droit
-- authenticated : SELECT, INSERT
GRANT SELECT, INSERT ON TABLE public.audit TO authenticated;

-- ----------------------------------------------------
-- 4. PERMISSIONS SUR LES SÉQUENCES
-- ----------------------------------------------------
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ----------------------------------------------------
-- 5. PERMISSIONS D'EXÉCUTION DES FONCTIONS ET PROCÉDURES (RPC)
-- ----------------------------------------------------
GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_event_by_organizer_code(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_victims_by_organizer_code(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_updated_at_timestamp_ms() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_signup() TO service_role;

-- ----------------------------------------------------
-- 6. PRIVILÈGES PAR DÉFAUT POUR TOUTES LES TABLES FUTURES
-- ----------------------------------------------------
-- Empêche toute régression lors de futures migrations ou créations de tables.

-- Rôle 'postgres' (Supabase CLI, migrations automatisées, Dashboard)
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
    GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
    GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public 
    GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Rôle actif courant (scripts exécutés directement dans le SQL Editor)
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
